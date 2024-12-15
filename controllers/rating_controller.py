from flask import jsonify, request, Blueprint
from models.rating import Rating
from models.users import User
from models.products import Product
from models.order import Order
from models.order_item import OrderItem
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db


rating_bp = Blueprint('rating_controller',__name__)


@rating_bp.route('/getallrating', methods=['GET'])
def get_all_rating():
    try:
        ratings = db.session.query(Rating).all()

        return jsonify([rating.to_dict() for rating in ratings]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get rating {e}'}), 500

@rating_bp.route('/getratingbyproduct/<int:product_id>', methods=['GET'])
def get_rating_by_product(product_id):
    try: 
        ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product_id).scalar()

        return jsonify({"rating": ratings}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get rating {e}'}), 500


@rating_bp.route('/getratingbyuser/<int:user_id>', methods=['GET'])
def get_rating_by_user(user_id):
    try:
        ratings = db.session.query(Rating).filter_by(user_id=user_id).all()
        return jsonify([rating.to_dict() for rating in ratings]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get rating {e}'}), 500
    
@rating_bp.route('/getratingbyorder/<int:order_id>', methods=['GET'])
def get_rating_by_order(order_id):
    try:
        ratings = db.session.query(Rating).filter_by(order_id=order_id).all()
        return jsonify([rating.to_dict() for rating in ratings]), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get rating {e}'}), 500

@rating_bp.route('/createrating/<int:order_id>',methods=['POST'])
@jwt_required()
def create_rating(order_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    require_fields = ['product_id', 'rating_product', 'review']

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    if data['rating_product'] < 1 or data['rating_product'] > 5:
        return jsonify({'error': 'Rating must be between 1 and 5'}), 400
    
    for field in require_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
        elif not data[field] or str(data[field]).strip() == " ":
            return jsonify({'error': f'{field} cannot be empty'}), 400

    try:
        order = db.session.query(Order).filter_by(order_id=order_id).first()
        orderItem = db.session.query(OrderItem).filter_by(order_id=order_id, product_id=data['product_id']).first()
        product = db.session.query(Product).filter_by(product_id=data['product_id']).first()
        user_id = order.user_id

        if order is None:
            return jsonify({'error': 'Order not found'}), 404
        elif order.status != 'completed':
            return jsonify({'error': 'Order is not completed'}), 400
        elif orderItem is None:
            return jsonify({'error': 'Order item not found'}), 404
        elif product is None:
            return jsonify({'error': 'Product not found'}), 404
        elif user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401

        rating = Rating(user_id=current_user_id, order_id=order_id, product_id=data['product_id'], rating_product=data['rating_product'], review=data['review'])
        db.session.add(rating)
        db.session.commit()
        return jsonify({'message': 'Rating created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create rating'}), 500
    




        


         
    