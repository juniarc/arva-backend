from flask import jsonify, request, Blueprint
from models.order_item import OrderItem
from models.products import Product
from models.order import Order
from models.users import User
from models.discount import Discount
from models.variant import Variant
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db
import datetime


orderItem_Bp= Blueprint('orderItem_controller', __name__)


@orderItem_Bp.route('/allorderitem', methods=['GET'])
def get_all_orderitem():
    try:
        order_item= db.session.query(OrderItem).all()
        return jsonify({[order.to_dict() for order in order_item]}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get order item'}), 500
    
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
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        discounts = product.discount
        
        
        if user is None:
            return jsonify({'error': 'Unauthorizhed: User not found'}), 404
        if order.order_id is None:
            return jsonify({'error': 'Order id not found'}), 404
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.stock < quantity:
            return jsonify({'error': 'Insufficient stock'}), 400
        if data['variant_id'] is not None:
            variant = db.session.query(Variant).filter_by(variant_id=data['variant_id']).first()
            if variant is None:
                return jsonify({'error': 'Variant not found'}), 404
            price = variant.price
        else:
            price = product.price

        for discount in discounts:
            if discount.start_date <= datetime.now() <= discount.end_date:
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

        db.session.add(orderItem)
        db.session.commit()
        return jsonify(orderItem.to_dict()), 201
    except Exception as e:
        return jsonify({'error': 'Failed to create order item'}), 500

# @orderItem_Bp.route('/updateorderitem/<int:orderitem_id>', methods=['PUT'])
# @jwt_required()
# def update_order_item(orderitem_id):
#     data = request.get_json()
#     current_user_id = int(get_jwt_identity())
#     require_fields= ['product_id', 'quantity', 'variant_id']
#     price = 0
#     discount_product = 0
#     quantity = int(data['quantity'])

#     if data is None:
#         return jsonify({'error': 'No data provided'}), 400
    
#     for field in require_fields:
#         if field not in data:
#             return jsonify({'error': f'Missing {field}'}), 400
#         elif not data[field] or str(data[field]).strip() == "":
#             return jsonify({'error': f'{field} cannot be empty'}), 400
        
#     try:
#         user = db.session.query(User).filter_by(user_id=current_user_id).first()        
#         product = db.session.query(Product).filter_by(product_id=data['product_id']).first()
#         orderItem = db.session.query(OrderItem).filter_by(orderitem_id=orderitem_id).first()
#         discounts = product.discount
        
        
#         if user is None:
#             return jsonify({'error': 'Unauthorizhed: User not found'}), 404
#         if orderItem.orderitem_id is None:
#             return jsonify({'error': 'Order item id not found'}), 404
        
        
    
        



