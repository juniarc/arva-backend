from flask import jsonify, request, Blueprint
from models.order_item import OrderItem
from models.products import Product
from models.order import Order
from models.users import User
from models.discount import Discount
from models.variant import Variant
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db
from datetime import datetime, timezone


orderItem_Bp= Blueprint('orderItem_controller', __name__)


@orderItem_Bp.route('/allorderitem', methods=['GET'])
def get_all_orderitem():
    try:
        order_item= db.session.query(OrderItem).all()
        return jsonify([order.to_dict() for order in order_item]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get order item {e}'}), 500
    
@orderItem_Bp.route('/orderitembyorderid/<int:order_id>', methods=['GET'])
def get_orderitem_by_orderid(order_id):
    try:
        order_item = db.session.query(OrderItem).filter_by(order_id=order_id).first()
        if order_item is None:
            return jsonify({'error': 'Order item not found'}), 404
            
        return jsonify(order_item.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get order item'}), 500
    
@orderItem_Bp.route('/orderitembyproductid/<int:product_id>', methods=['GET'])
def get_orderitem_by_productid(product_id):
    try:
        order_item = db.session.query(OrderItem).filter_by(product_id=product_id).all()
        return jsonify([ order.to_dict() for order in order_item]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get order item'}), 500
    
@orderItem_Bp.route('/createorderitem/<int:order_id>', methods=['POST'])
@jwt_required()
def create_order_item(order_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    require_fields= ['product_id', 'quantity', 'variant_id']
    price = 0
    discount_product = 0
    quantity = int(data['quantity'])

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    for field in require_fields:
        if field not in data:
            return jsonify({'error': f'Missing {field}'}), 400
        elif not data[field] or str(data[field]).strip() == "":
            return jsonify({'error': f'{field} cannot be empty'}), 400
        
    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()        
        product = db.session.query(Product).filter_by(product_id=data['product_id']).first()
        variant = db.session.query(Variant).filter_by(variant_id=data['variant_id']).first()
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        discounts = db.session.query(Discount).filter_by(product_id=data['product_id']).all()
        
        if user is None:
            return jsonify({'error': 'Unauthorizhed: User not found'}), 404
        elif user.user_id != order.user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        elif order is None:
            return jsonify({'error': 'Order id not found'}), 404
        elif product is None:
            return jsonify({'error': 'Product not found'}), 404
        elif variant is None:
            return jsonify({'error': 'Variant not found'}), 404
         
        if variant.stock < quantity:
            return jsonify({'error': 'Insufficient stock'}), 400

        price = variant.price
        if price is None:
            return jsonify({'error': 'Price for variant is not set'}), 400
        if discounts:
            for discount in discounts:
                now = datetime.now(timezone.utc)
                if discount.start_date <= now <= discount.end_date:
                    if discount.discount_type == 'percentage':
                        discount_product += price * discount.discount_value / 100
                    if discount.discount_type == 'fixed':
                        discount_product += discount.discount_value

        

        orderItem = OrderItem(
            order_id=order_id, 
            product_id=product.product_id, 
            quantity=quantity, 
            unit_price= price,
            total_price = (price - discount_product) * quantity 
            )

        variant.stock -= quantity
        product.sold += quantity
        order.total_amount += orderItem.total_price

        db.session.add(orderItem)
        db.session.commit()
        return jsonify(orderItem.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        print(e)
        return jsonify({'error': f'Failed to create order item {e}'}), 500

#create order & orderItem
@orderItem_Bp.route('/createorderandorderitem', methods=['POST'])
@jwt_required()
def create_order_and_order_item():
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    require_fields = ['product_id', 'quantity', 'variant_id']
    price = 0
    discount_product = 0


    if data is None:
        return jsonify({'error': 'No data provided'}), 400

    for field in require_fields:
        if field not in data:
            return jsonify({'error': f'Missing {field}'}), 400
        elif not data[field] or str(data[field]).strip() == "":
            return jsonify({'error': f'{field} cannot be empty'}), 400

    try:
        user = db.session.query(User).filter_by(user_id=current_user_id).first()
        product = db.session.query(Product).filter_by(product_id=data['product_id']).first()
        variant = db.session.query(Variant).filter_by(variant_id=data['variant_id']).first()
        discounts = db.session.query(Discount).filter_by(product_id=data['product_id']).all()

        if user is None:
            return jsonify({'error': 'Unauthorizhed: User not found'}), 404
        elif product is None:
            return jsonify({'error': 'Product not found'}), 404
        elif variant is None:
            return jsonify({'error': 'Variant not found'}), 404

        quantity = int(data['quantity'])
        if variant.stock < quantity:
            return jsonify({'error': 'Insufficient stock'}), 400

        price = variant.price
        if price is None:
            return jsonify({'error': 'Price for variant is not set'}), 400
        if discounts:
            for discount in discounts:
                now = datetime.now(timezone.utc)
                if discount.start_date <= now <= discount.end_date:
                    if discount.discount_type == 'percentage':
                        discount_product += price * discount.discount_value / 100
                    if discount.discount_type == 'fixed':
                        discount_product += discount.discount_value

        order = Order(user_id=user.user_id)
        db.session.add(order)
        db.session.commit()

        orderItem = OrderItem(
            order_id=order.order_id,
            product_id=product.product_id,
            quantity=quantity,
            unit_price=price,
            total_price= (price - discount_product) * quantity
        )

        variant.stock -= quantity
        product.sold += quantity
        order.total_amount += orderItem.total_price
        
        db.session.add(orderItem)
        db.session.commit()

        return jsonify(orderItem.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create order and order item {e}'}), 500
    


    
    

        
        
    
        



