from flask import jsonify, request, Blueprint
from models.order import Order
from models.users import User
from models.products import Product
from models.order_item import OrderItem
from models.voucher import Voucher
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db
from datetime import datetime, timezone


order_bp = Blueprint('order_controller', __name__)


@order_bp.route('/allorder', methods=['GET'])
def get_all_order():
    try:
        orders = db.session.query(Order).all()
        return jsonify([order.to_dict() for order in orders]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get all orders {e}'}), 500


@order_bp.route('/getorder/<int:order_id>', methods=['GET'])
def get_order(order_id):
    try:
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        if order is None:
            return jsonify({'error': 'Order not found'}), 404
        return jsonify(order.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get order'}), 500
    
@order_bp.route('/getorderbyuserid/<int:user_id>', methods=['GET'])
def get_order_by_user_id(user_id):
    try:
        orders = db.session.query(Order).filter_by(user_id=user_id).all()
        return jsonify([order.to_dict() for order in orders]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get order by user id'}), 500


@order_bp.route('/createorder', methods=['POST'])
@jwt_required()
def create_order():
    current_user_id = int(get_jwt_identity())
    
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        if user is None or user.status != 'active':
            return jsonify({'error': 'User Not Found'}), 401
        order = Order(user_id= current_user_id)
        db.session.add(order)
        db.session.commit()
        return jsonify({'message': 'Order created succesfully','order_id': order.order_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create order'}), 500
    
@order_bp.route('/updateorder/<int:order_id>', methods=['PUT'])
@jwt_required()
def update_order(order_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data Provided'}), 400

    try:
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        if order.user_id != current_user_id:
            return jsonify({'error': 'Unathorized: Insufficient permission'}), 401

        order.total_amount = data.get('total_amount', order.total_amount)
        order.status = data.get('status', order.status)

        db.session.commit()
        return jsonify({'message': 'Update order successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update order'})

@order_bp.route('/deleteorder/<int:order_id>', methods= ['DELETE'])
@jwt_required()
def delete_order(order_id):

    current_useer_id = int(get_jwt_identity())

    try:
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        if order.user_id != current_useer_id:
            return jsonify({'error': 'Unauthorized: Insufficient permission'}), 401
        db.session.delete(order)
        db.session.commit()
        return jsonify({'message': 'Order deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete order'}), 500


@order_bp.route('/checkoutorder/<int:order_id>', methods=['PUT'])
@jwt_required()
def checkout_order(order_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    voucher_id = None
    shopID_list = []
    total_products_amount = 0
    voucher_dicount = 0
    

    try:
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        order_item = db.session.query(OrderItem).filter_by(order_id=order_id).all()

        if order is None:
            return jsonify({'error': 'Order not found'}), 404
        elif order.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permission'}), 401

        if data and data.get('voucher_id'):
            voucher_id = data.get('voucher_id')
            voucher = db.session.query(Voucher).filter_by(voucher_id=voucher_id).first()
            if voucher is None:
                return jsonify({'error': 'Voucher not found'}), 404
            
            for item in order_item:
                shopID = item.product.shop_id
                shopID_list.append(shopID)
                if shopID == voucher.shop_id:
                    total_products_amount += item.total_price
            
            if voucher.shop_id not in shopID_list:
                return jsonify({'error': 'Voucher not applicable to this order'}), 400

            now = datetime.now(timezone.utc)
            if voucher.start_date > now or voucher.end_date < now:
                return jsonify({'error': 'Voucher is not valid'}), 400

            if voucher.voucher_type == 'percentage':
                voucher_dicount = (total_products_amount * voucher.voucher_value) / 100
            elif voucher.voucher_type == 'fixed':
                voucher_dicount = voucher.voucher_value

            order.payment_amount = order.total_amount - voucher_dicount

       
        order.status = 'completed'
        db.session.commit()
        return jsonify({'message': 'Order checkout successfully',
                        'payment_amount': order.payment_amount,
                        'voucher_discount': voucher_dicount,
                        'total_amount': order.total_amount,
                        'order_id': order.order_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to checkout order {e}'}), 500
    

@order_bp.route('/getcompleteorderbyuser/<int:user_id>', methods=['GET'])
def get_complete_order_by_user_id(user_id):
    try:
        orders = db.session.query(Order).filter_by(user_id=user_id, status='completed').all()
        return jsonify([order.to_dict() for order in orders]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get complete order by user id'}), 500